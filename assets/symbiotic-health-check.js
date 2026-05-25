#!/usr/bin/env node

/**
 * Symbiotic Security Health Check Script
 * This script verifies system prerequisites for installing @symbioticsec/code
 */

const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const REQUIRED_ENDPOINTS = [
  { host: 'api.symbioticsec.ai', port: 443 },
  { host: 'llm-proxy.symbioticsec.ai', port: 443 }
];

const NPM_REGISTRY = 'registry.npmjs.org';
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class HealthCheck {
  constructor() {
    this.results = [];
    this.errors = [];
    this.warnings = [];
  }

  log(message, color = COLORS.reset) {
    console.log(`${color}${message}${COLORS.reset}`);
  }

  logSection(title) {
    this.log(`\n${'='.repeat(60)}`, COLORS.cyan);
    this.log(title, COLORS.cyan);
    this.log('='.repeat(60), COLORS.cyan);
  }

  logResult(check, passed, message = '') {
    const symbol = passed ? '✓' : '✗';
    const color = passed ? COLORS.green : COLORS.red;
    this.log(`${symbol} ${check}${message ? ': ' + message : ''}`, color);
    
    this.results.push({ check, passed, message });
    if (!passed) {
      this.errors.push({ check, message });
    }
  }

  logWarning(message) {
    this.log(`⚠ ${message}`, COLORS.yellow);
    this.warnings.push(message);
  }

  async checkNodeVersion() {
    this.logSection('Checking Node.js Installation');
    try {
      const version = process.version;
      const majorVersion = parseInt(version.slice(1).split('.')[0]);
      
      this.logResult('Node.js installed', true, version);
      
      if (majorVersion < 14) {
        this.logWarning('Node.js version is below 14. Consider upgrading to Node.js 14 or higher.');
      }
      return true;
    } catch (error) {
      this.logResult('Node.js installed', false, error.message);
      return false;
    }
  }

  async checkNpmVersion() {
    try {
      const { stdout } = await execAsync('npm --version');
      const version = stdout.trim();
      this.logResult('npm installed', true, version);
      return true;
    } catch (error) {
      this.logResult('npm installed', false, 'npm not found');
      return false;
    }
  }

  async checkGlobalInstallPermissions() {
    this.logSection('Checking npm Global Install Permissions');
    
    try {
      const { stdout: globalPrefix } = await execAsync('npm config get prefix');
      this.log(`Global npm prefix: ${globalPrefix.trim()}`, COLORS.blue);
      
      // Test if we can write to the global directory
      try {
        await execAsync('npm install -g npm-check-permissions --dry-run 2>&1');
        this.logResult('Global install permissions', true);
        return true;
      } catch (error) {
        const errorMessage = error.message || error.stderr || '';
        
        if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
          this.logResult('Global install permissions', false, 'Permission denied');
          this.log('\nSolution:', COLORS.yellow);
          
          if (process.platform === 'win32') {
            this.log('• Run Command Prompt or PowerShell as Administrator', COLORS.yellow);
          } else {
            this.log('• Use: sudo npm install -g @symbioticsec/code', COLORS.yellow);
            this.log('• Or configure npm to use a different directory:', COLORS.yellow);
            this.log('  mkdir ~/.npm-global', COLORS.yellow);
            this.log('  npm config set prefix "~/.npm-global"', COLORS.yellow);
            this.log('  export PATH=~/.npm-global/bin:$PATH', COLORS.yellow);
          }
          return false;
        }
        
        // Dry-run might fail for other reasons, so we'll be lenient
        this.logWarning('Could not verify global install permissions. May require elevated privileges.');
        return true;
      }
    } catch (error) {
      this.logResult('Global install permissions', false, error.message);
      return false;
    }
  }

  async checkExecutionPolicy() {
    if (process.platform !== 'win32') {
      return true;
    }

    this.logSection('Checking Windows Execution Policy');
    
    try {
      const { stdout } = await execAsync('powershell -Command "Get-ExecutionPolicy"', { shell: 'powershell.exe' });
      const policy = stdout.trim();
      
      this.log(`Current Execution Policy: ${policy}`, COLORS.blue);
      
      if (policy === 'Restricted') {
        this.logResult('Execution Policy', false, 'Policy is Restricted');
        this.log('\nSolution: Run PowerShell as Administrator and execute:', COLORS.yellow);
        this.log('Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser', COLORS.yellow);
        return false;
      } else {
        this.logResult('Execution Policy', true, policy);
        return true;
      }
    } catch (error) {
      this.logWarning('Could not check execution policy. This may cause issues on Windows.');
      return true;
    }
  }

  async checkNetworkConnectivity(host, port) {
    return new Promise((resolve) => {
      const options = {
        host: host,
        port: port,
        method: 'GET',
        path: '/',
        timeout: 5000,
        // Disable certificate validation to only test connectivity
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        resolve({ success: true, statusCode: res.statusCode });
      });

      req.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Connection timeout' });
      });

      req.end();
    });
  }

  async checkRequiredEndpoints() {
    this.logSection('Checking Network Connectivity to Required Endpoints');
    
    let allPassed = true;
    
    for (const endpoint of REQUIRED_ENDPOINTS) {
      const result = await this.checkNetworkConnectivity(endpoint.host, endpoint.port);
      
      if (result.success) {
        this.logResult(`${endpoint.host}:${endpoint.port}`, true, `Connected (HTTP ${result.statusCode})`);
      } else {
        this.logResult(`${endpoint.host}:${endpoint.port}`, false, result.error);
        allPassed = false;
      }
    }
    
    if (!allPassed) {
      this.log('\nPossible causes:', COLORS.yellow);
      this.log('• Corporate firewall blocking connections', COLORS.yellow);
      this.log('• Proxy configuration needed', COLORS.yellow);
      this.log('• VPN required for external connections', COLORS.yellow);
      this.log('\nContact your IT/Network administrator for assistance.', COLORS.yellow);
    }
    
    return allPassed;
  }

  async checkNpmRegistry() {
    this.logSection('Checking npm Registry Access');
    
    const result = await this.checkNetworkConnectivity(NPM_REGISTRY, 443);
    
    if (result.success) {
      this.logResult('npm registry access', true);
      
      // Try to fetch package info
      try {
        const { stdout } = await execAsync('npm view @symbioticsec/code version --json 2>&1', { timeout: 10000 });
        const version = stdout.trim().replace(/"/g, '');
        if (version && !version.includes('error')) {
          this.log(`Latest version available: ${version}`, COLORS.blue);
        }
      } catch (error) {
        // Package might not exist or other issues, but registry is accessible
        this.logWarning('Could not fetch package information. Package may not be published yet.');
      }
      
      return true;
    } else {
      this.logResult('npm registry access', false, result.error);
      this.log('\nThis will prevent npm package downloads.', COLORS.yellow);
      this.log('Check proxy settings: npm config get proxy', COLORS.yellow);
      this.log('Check https-proxy: npm config get https-proxy', COLORS.yellow);
      return false;
    }
  }

  async checkProxyConfiguration() {
    this.logSection('Checking Proxy Configuration');
    
    try {
      const { stdout: httpProxy } = await execAsync('npm config get proxy');
      const { stdout: httpsProxy } = await execAsync('npm config get https-proxy');
      
      const httpProxyValue = httpProxy.trim();
      const httpsProxyValue = httpsProxy.trim();
      
      if (httpProxyValue !== 'null' && httpProxyValue !== '') {
        this.log(`HTTP Proxy: ${httpProxyValue}`, COLORS.blue);
      } else {
        this.log('HTTP Proxy: Not configured', COLORS.blue);
      }
      
      if (httpsProxyValue !== 'null' && httpsProxyValue !== '') {
        this.log(`HTTPS Proxy: ${httpsProxyValue}`, COLORS.blue);
      } else {
        this.log('HTTPS Proxy: Not configured', COLORS.blue);
      }
      
      // Check environment variables
      if (process.env.HTTP_PROXY || process.env.http_proxy) {
        this.log(`Environment HTTP_PROXY: ${process.env.HTTP_PROXY || process.env.http_proxy}`, COLORS.blue);
      }
      
      if (process.env.HTTPS_PROXY || process.env.https_proxy) {
        this.log(`Environment HTTPS_PROXY: ${process.env.HTTPS_PROXY || process.env.https_proxy}`, COLORS.blue);
      }
      
      return true;
    } catch (error) {
      this.logWarning('Could not check proxy configuration');
      return true;
    }
  }

  printSummary() {
    this.logSection('Health Check Summary');
    
    const totalChecks = this.results.length;
    const passedChecks = this.results.filter(r => r.passed).length;
    const failedChecks = totalChecks - passedChecks;
    
    this.log(`\nTotal Checks: ${totalChecks}`, COLORS.blue);
    this.log(`Passed: ${passedChecks}`, COLORS.green);
    this.log(`Failed: ${failedChecks}`, failedChecks > 0 ? COLORS.red : COLORS.green);
    this.log(`Warnings: ${this.warnings.length}`, COLORS.yellow);
    
    if (failedChecks === 0 && this.warnings.length === 0) {
      this.log('\n✓ Your system is ready to install @symbioticsec/code!', COLORS.green);
      this.log('\nRun: npm install -g @symbioticsec/code', COLORS.cyan);
    } else if (failedChecks === 0) {
      this.log('\n⚠ Your system should be able to install @symbioticsec/code, but there are warnings.', COLORS.yellow);
      this.log('Review the warnings above before proceeding.', COLORS.yellow);
    } else {
      this.log('\n✗ Your system has issues that must be resolved before installation.', COLORS.red);
      this.log('\nFailed checks:', COLORS.red);
      this.errors.forEach(error => {
        this.log(`  • ${error.check}: ${error.message}`, COLORS.red);
      });
      this.log('\nPlease address the issues above and run this check again.', COLORS.yellow);
    }
    
    this.log('\n' + '='.repeat(60) + '\n', COLORS.cyan);
  }

  async run() {
    this.log('\n╔════════════════════════════════════════════════════════════╗', COLORS.cyan);
    this.log('║     Symbiotic Security - Installation Health Check        ║', COLORS.cyan);
    this.log('╚════════════════════════════════════════════════════════════╝', COLORS.cyan);
    
    await this.checkNodeVersion();
    await this.checkNpmVersion();
    await this.checkGlobalInstallPermissions();
    await this.checkExecutionPolicy();
    await this.checkProxyConfiguration();
    await this.checkNpmRegistry();
    await this.checkRequiredEndpoints();
    
    this.printSummary();
    
    // Exit with appropriate code
    process.exit(this.errors.length > 0 ? 1 : 0);
  }
}

// Run the health check
const healthCheck = new HealthCheck();
healthCheck.run().catch(error => {
  console.error('Fatal error running health check:', error);
  process.exit(1);
});
