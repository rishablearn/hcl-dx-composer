# SSL/TLS Configuration Guide

This guide covers SSL certificate setup for HCL DX Composer, including self-signed certificates, Let's Encrypt, and importing existing certificates.

## Quick Start

### Option 1: Self-Signed Certificate (Development)

```bash
# Generate self-signed certificate for localhost
./scripts/ssl-setup.sh self-signed localhost 365

# Deploy with SSL
./scripts/deploy.sh --ssl --build
```

### Option 2: Let's Encrypt (Production)

```bash
# Generate Let's Encrypt certificate (requires public domain)
./scripts/ssl-setup.sh letsencrypt yourdomain.com admin@yourdomain.com

# Deploy with SSL
./scripts/deploy.sh --ssl --build
```

### Option 3: Import Existing Certificate

```bash
# Import your organization's certificate
./scripts/ssl-setup.sh import /path/to/cert.pem /path/to/key.pem /path/to/chain.pem

# Deploy with SSL
./scripts/deploy.sh --ssl --build
```

## SSL Setup Script

The `scripts/ssl-setup.sh` script provides comprehensive SSL certificate management:

### Commands

| Command | Description |
|---------|-------------|
| `self-signed [domain] [days]` | Generate self-signed certificate |
| `letsencrypt <domain> <email>` | Generate Let's Encrypt certificate |
| `import <cert> <key> [chain]` | Import existing certificate |
| `status` | Check certificate status and expiration |
| `disable` | Disable SSL mode |

### Examples

```bash
# Self-signed for localhost (default)
./scripts/ssl-setup.sh self-signed

# Self-signed for custom domain with 2-year validity
./scripts/ssl-setup.sh self-signed myapp.local 730

# Let's Encrypt with staging (testing)
./scripts/ssl-setup.sh letsencrypt example.com admin@example.com staging

# Import certificate with chain
./scripts/ssl-setup.sh import cert.pem key.pem chain.pem

# Check certificate status
./scripts/ssl-setup.sh status
```

## Directory Structure

```
ssl/
├── certs/
│   └── server.crt        # SSL certificate
├── private/
│   ├── server.key        # Private key (chmod 600)
│   └── server.pem        # Combined cert+key
└── openssl.cnf           # OpenSSL config (auto-generated)
```

## Environment Configuration

SSL settings in `.env`:

```env
# Enable/disable SSL
SSL_ENABLED=true

# Certificate type: self-signed, letsencrypt, imported
SSL_TYPE=self-signed

# Domain name
SSL_DOMAIN=localhost

# HTTPS port (default 443)
FRONTEND_SSL_PORT=443
```

## Deployment with SSL

### Method 1: Command Line Flag

```bash
# Deploy with SSL (auto-generates cert if missing)
./scripts/deploy.sh --ssl --build
```

### Method 2: Environment Variable

```bash
# Set in .env
SSL_ENABLED=true

# Then deploy normally
./scripts/deploy.sh --build
```

## How It Works

### Architecture

```
┌─────────────┐     HTTPS/443     ┌─────────────┐     HTTP/3001     ┌─────────────┐
│   Browser   │ ─────────────────▶│    Nginx    │ ──────────────────▶│   Backend   │
│             │◀───────────────── │  (SSL Term) │◀────────────────── │   (Node.js) │
└─────────────┘                   └─────────────┘                    └─────────────┘
```

1. **Nginx** handles SSL termination on port 443
2. **Backend** receives plain HTTP traffic on internal network
3. **API requests** (`/api/*`) are proxied to backend container

### Docker Compose Override

SSL mode uses `docker-compose-ssl.yml` as an override:

```bash
# Equivalent to:
docker compose -f docker-compose.yml -f docker-compose-ssl.yml up -d
```

## Self-Signed Certificate Trust

### macOS

```bash
# Add to system keychain
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  ssl/certs/server.crt
```

### Linux (Ubuntu/Debian)

```bash
# Copy certificate
sudo cp ssl/certs/server.crt /usr/local/share/ca-certificates/hcl-dx-composer.crt

# Update CA certificates
sudo update-ca-certificates
```

### Windows

1. Double-click `ssl/certs/server.crt`
2. Click "Install Certificate"
3. Select "Local Machine" → "Trusted Root Certification Authorities"

### Browser-Specific

For Chrome/Firefox, you can also accept the certificate warning and proceed.

## Let's Encrypt Renewal

Certificates from Let's Encrypt are valid for 90 days. Auto-renewal is handled by the certbot container.

### Manual Renewal

```bash
# Renew certificates
docker exec hcl-dx-certbot certbot renew

# Reload nginx
docker exec hcl-dx-frontend nginx -s reload
```

### Cron Job (if not using certbot container)

```bash
# Add to crontab
0 0 1 * * /path/to/hcl-dx-composer/ssl/renewal-hook.sh
```

## Troubleshooting

### Certificate Not Found

```bash
# Check certificate exists
./scripts/ssl-setup.sh status

# Regenerate if needed
./scripts/ssl-setup.sh self-signed localhost
```

### Certificate/Key Mismatch

```bash
# Verify they match
openssl x509 -noout -modulus -in ssl/certs/server.crt | openssl md5
openssl rsa -noout -modulus -in ssl/private/server.key | openssl md5
# Both should output the same MD5 hash
```

### Port 443 Already in Use

```bash
# Check what's using port 443
lsof -i :443

# Stop the conflicting service or use a different port
FRONTEND_SSL_PORT=8443 ./scripts/deploy.sh --ssl --build
```

### Let's Encrypt Rate Limits

For testing, use the staging environment:

```bash
./scripts/ssl-setup.sh letsencrypt example.com admin@example.com staging
```

## Security Best Practices

1. **Never commit SSL private keys** to version control
2. **Use Let's Encrypt** for production environments
3. **Enable HSTS** for production (uncomment in nginx-ssl.conf)
4. **Rotate certificates** regularly (Let's Encrypt does this automatically)
5. **Use strong cipher suites** (already configured in nginx-ssl.conf)

## Files Reference

| File | Purpose |
|------|---------|
| `scripts/ssl-setup.sh` | SSL certificate management script |
| `frontend/nginx-ssl.conf` | Nginx configuration with SSL |
| `frontend/Dockerfile.ssl` | Dockerfile with SSL support |
| `docker-compose-ssl.yml` | Docker Compose SSL override |
| `ssl/certs/server.crt` | SSL certificate |
| `ssl/private/server.key` | Private key |
