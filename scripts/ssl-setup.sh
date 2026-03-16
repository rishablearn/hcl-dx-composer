#!/bin/bash

# =============================================================================
# SSL Certificate Setup Script for HCL DX Composer
# Supports: Self-signed, Let's Encrypt, and importing existing certificates
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SSL_DIR="$PROJECT_ROOT/ssl"
CERTS_DIR="$SSL_DIR/certs"
PRIVATE_DIR="$SSL_DIR/private"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}============================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Create SSL directory structure
setup_ssl_directories() {
    print_info "Setting up SSL directory structure..."
    mkdir -p "$CERTS_DIR"
    mkdir -p "$PRIVATE_DIR"
    chmod 700 "$PRIVATE_DIR"
    print_success "SSL directories created"
}

# Generate self-signed certificate
generate_self_signed() {
    local domain="${1:-localhost}"
    local days="${2:-365}"
    
    print_header "Generating Self-Signed SSL Certificate"
    print_info "Domain: $domain"
    print_info "Validity: $days days"
    
    setup_ssl_directories
    
    # Generate private key
    openssl genrsa -out "$PRIVATE_DIR/server.key" 2048
    
    # Create certificate signing request config
    cat > "$SSL_DIR/openssl.cnf" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = US
ST = State
L = City
O = HCL DX Composer
OU = Development
CN = $domain

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = $domain
DNS.2 = localhost
DNS.3 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

    # Generate self-signed certificate
    openssl req -new -x509 \
        -key "$PRIVATE_DIR/server.key" \
        -out "$CERTS_DIR/server.crt" \
        -days "$days" \
        -config "$SSL_DIR/openssl.cnf" \
        -extensions v3_req
    
    # Set permissions
    chmod 644 "$CERTS_DIR/server.crt"
    chmod 600 "$PRIVATE_DIR/server.key"
    
    # Create combined PEM file for some applications
    cat "$CERTS_DIR/server.crt" "$PRIVATE_DIR/server.key" > "$PRIVATE_DIR/server.pem"
    chmod 600 "$PRIVATE_DIR/server.pem"
    
    print_success "Self-signed certificate generated successfully!"
    print_info "Certificate: $CERTS_DIR/server.crt"
    print_info "Private Key: $PRIVATE_DIR/server.key"
    
    # Update .env file
    update_env_ssl "self-signed" "$domain"
    
    print_warning "Note: Browsers will show a security warning for self-signed certificates."
    print_info "You can add the certificate to your system's trusted store to avoid warnings."
}

# Generate Let's Encrypt certificate using certbot
generate_letsencrypt() {
    local domain="$1"
    local email="$2"
    local staging="${3:-false}"
    
    if [ -z "$domain" ] || [ -z "$email" ]; then
        print_error "Domain and email are required for Let's Encrypt"
        echo "Usage: $0 letsencrypt <domain> <email> [staging]"
        exit 1
    fi
    
    print_header "Generating Let's Encrypt SSL Certificate"
    print_info "Domain: $domain"
    print_info "Email: $email"
    
    setup_ssl_directories
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        print_warning "Certbot not found. Installing..."
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew install certbot
        elif command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y certbot
        elif command -v yum &> /dev/null; then
            sudo yum install -y certbot
        else
            print_error "Please install certbot manually: https://certbot.eff.org/"
            exit 1
        fi
    fi
    
    # Build certbot command
    local certbot_cmd="certbot certonly --standalone"
    certbot_cmd="$certbot_cmd -d $domain"
    certbot_cmd="$certbot_cmd --email $email"
    certbot_cmd="$certbot_cmd --agree-tos"
    certbot_cmd="$certbot_cmd --non-interactive"
    
    if [ "$staging" = "true" ]; then
        certbot_cmd="$certbot_cmd --staging"
        print_warning "Using Let's Encrypt staging environment (for testing)"
    fi
    
    # Stop any services using port 80
    print_info "Stopping services on port 80 temporarily..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" stop frontend 2>/dev/null || true
    
    # Run certbot
    print_info "Running certbot..."
    eval $certbot_cmd
    
    # Copy certificates to our SSL directory
    local le_dir="/etc/letsencrypt/live/$domain"
    if [ -d "$le_dir" ]; then
        sudo cp "$le_dir/fullchain.pem" "$CERTS_DIR/server.crt"
        sudo cp "$le_dir/privkey.pem" "$PRIVATE_DIR/server.key"
        sudo chown $(whoami):$(id -gn) "$CERTS_DIR/server.crt" "$PRIVATE_DIR/server.key"
        chmod 644 "$CERTS_DIR/server.crt"
        chmod 600 "$PRIVATE_DIR/server.key"
        
        print_success "Let's Encrypt certificate generated successfully!"
        
        # Create renewal hook script
        create_renewal_hook "$domain"
        
        update_env_ssl "letsencrypt" "$domain"
    else
        print_error "Certificate not found at $le_dir"
        exit 1
    fi
}

# Import existing certificate
import_certificate() {
    local cert_path="$1"
    local key_path="$2"
    local chain_path="$3"
    
    if [ -z "$cert_path" ] || [ -z "$key_path" ]; then
        print_error "Certificate and key paths are required"
        echo "Usage: $0 import <cert_path> <key_path> [chain_path]"
        exit 1
    fi
    
    if [ ! -f "$cert_path" ]; then
        print_error "Certificate file not found: $cert_path"
        exit 1
    fi
    
    if [ ! -f "$key_path" ]; then
        print_error "Key file not found: $key_path"
        exit 1
    fi
    
    print_header "Importing Existing SSL Certificate"
    
    setup_ssl_directories
    
    # Copy certificate
    cp "$cert_path" "$CERTS_DIR/server.crt"
    chmod 644 "$CERTS_DIR/server.crt"
    print_success "Certificate copied"
    
    # Copy private key
    cp "$key_path" "$PRIVATE_DIR/server.key"
    chmod 600 "$PRIVATE_DIR/server.key"
    print_success "Private key copied"
    
    # Copy chain if provided
    if [ -n "$chain_path" ] && [ -f "$chain_path" ]; then
        cat "$chain_path" >> "$CERTS_DIR/server.crt"
        print_success "Certificate chain appended"
    fi
    
    # Verify certificate and key match
    cert_modulus=$(openssl x509 -noout -modulus -in "$CERTS_DIR/server.crt" 2>/dev/null | openssl md5)
    key_modulus=$(openssl rsa -noout -modulus -in "$PRIVATE_DIR/server.key" 2>/dev/null | openssl md5)
    
    if [ "$cert_modulus" != "$key_modulus" ]; then
        print_error "Certificate and private key do not match!"
        rm -f "$CERTS_DIR/server.crt" "$PRIVATE_DIR/server.key"
        exit 1
    fi
    
    print_success "Certificate and key verified - they match!"
    
    # Extract domain from certificate
    local domain=$(openssl x509 -noout -subject -in "$CERTS_DIR/server.crt" | sed -n 's/.*CN=\([^,\/]*\).*/\1/p')
    
    update_env_ssl "imported" "${domain:-localhost}"
    
    print_success "Certificate imported successfully!"
}

# Create Let's Encrypt renewal hook
create_renewal_hook() {
    local domain="$1"
    
    cat > "$SSL_DIR/renewal-hook.sh" << EOF
#!/bin/bash
# Let's Encrypt renewal hook for HCL DX Composer

LE_DIR="/etc/letsencrypt/live/$domain"
SSL_DIR="$SSL_DIR"

cp "\$LE_DIR/fullchain.pem" "\$SSL_DIR/certs/server.crt"
cp "\$LE_DIR/privkey.pem" "\$SSL_DIR/private/server.key"
chmod 644 "\$SSL_DIR/certs/server.crt"
chmod 600 "\$SSL_DIR/private/server.key"

# Reload nginx
docker exec hcl-dx-frontend nginx -s reload 2>/dev/null || true

echo "SSL certificates renewed and nginx reloaded"
EOF
    
    chmod +x "$SSL_DIR/renewal-hook.sh"
    print_info "Renewal hook created: $SSL_DIR/renewal-hook.sh"
    print_info "Add to crontab: 0 0 1 * * certbot renew --post-hook '$SSL_DIR/renewal-hook.sh'"
}

# Update .env file with SSL configuration
update_env_ssl() {
    local ssl_type="$1"
    local domain="$2"
    local env_file="$PROJECT_ROOT/.env"
    
    if [ ! -f "$env_file" ]; then
        print_warning ".env file not found. Please run setup.sh first."
        return
    fi
    
    # Update or add SSL settings
    if grep -q "^SSL_ENABLED=" "$env_file"; then
        sed -i.bak "s/^SSL_ENABLED=.*/SSL_ENABLED=true/" "$env_file"
    else
        echo "SSL_ENABLED=true" >> "$env_file"
    fi
    
    if grep -q "^SSL_TYPE=" "$env_file"; then
        sed -i.bak "s/^SSL_TYPE=.*/SSL_TYPE=$ssl_type/" "$env_file"
    else
        echo "SSL_TYPE=$ssl_type" >> "$env_file"
    fi
    
    if grep -q "^SSL_DOMAIN=" "$env_file"; then
        sed -i.bak "s/^SSL_DOMAIN=.*/SSL_DOMAIN=$domain/" "$env_file"
    else
        echo "SSL_DOMAIN=$domain" >> "$env_file"
    fi
    
    # Update VITE_API_BASE_URL to use HTTPS
    if grep -q "^VITE_API_BASE_URL=" "$env_file"; then
        sed -i.bak "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=https://$domain/api|" "$env_file"
    fi
    
    # Clean up backup files
    rm -f "$env_file.bak"
    
    print_success ".env file updated with SSL configuration"
}

# Disable SSL
disable_ssl() {
    print_header "Disabling SSL"
    
    local env_file="$PROJECT_ROOT/.env"
    
    if [ -f "$env_file" ]; then
        if grep -q "^SSL_ENABLED=" "$env_file"; then
            sed -i.bak "s/^SSL_ENABLED=.*/SSL_ENABLED=false/" "$env_file"
        fi
        rm -f "$env_file.bak"
    fi
    
    print_success "SSL disabled"
    print_info "Run docker-compose up -d --build to apply changes"
}

# Check SSL status
check_ssl_status() {
    print_header "SSL Certificate Status"
    
    if [ ! -f "$CERTS_DIR/server.crt" ]; then
        print_warning "No SSL certificate found"
        return
    fi
    
    echo ""
    print_info "Certificate Information:"
    echo "------------------------"
    
    # Subject
    local subject=$(openssl x509 -noout -subject -in "$CERTS_DIR/server.crt" 2>/dev/null)
    echo "Subject: ${subject#*=}"
    
    # Issuer
    local issuer=$(openssl x509 -noout -issuer -in "$CERTS_DIR/server.crt" 2>/dev/null)
    echo "Issuer: ${issuer#*=}"
    
    # Validity
    local start_date=$(openssl x509 -noout -startdate -in "$CERTS_DIR/server.crt" 2>/dev/null)
    local end_date=$(openssl x509 -noout -enddate -in "$CERTS_DIR/server.crt" 2>/dev/null)
    echo "Valid From: ${start_date#*=}"
    echo "Valid Until: ${end_date#*=}"
    
    # Check expiration
    if openssl x509 -checkend 2592000 -noout -in "$CERTS_DIR/server.crt" 2>/dev/null; then
        print_success "Certificate is valid for more than 30 days"
    else
        if openssl x509 -checkend 0 -noout -in "$CERTS_DIR/server.crt" 2>/dev/null; then
            print_warning "Certificate will expire within 30 days"
        else
            print_error "Certificate has expired!"
        fi
    fi
    
    # SANs
    echo ""
    print_info "Subject Alternative Names:"
    openssl x509 -noout -ext subjectAltName -in "$CERTS_DIR/server.crt" 2>/dev/null || echo "  None"
}

# Show usage
show_usage() {
    echo "SSL Certificate Setup for HCL DX Composer"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  self-signed [domain] [days]     Generate self-signed certificate"
    echo "  letsencrypt <domain> <email>    Generate Let's Encrypt certificate"
    echo "  import <cert> <key> [chain]     Import existing certificate"
    echo "  status                          Check SSL certificate status"
    echo "  disable                         Disable SSL"
    echo ""
    echo "Examples:"
    echo "  $0 self-signed localhost 365"
    echo "  $0 letsencrypt example.com admin@example.com"
    echo "  $0 import /path/to/cert.pem /path/to/key.pem"
    echo "  $0 status"
}

# Main
case "${1:-}" in
    self-signed|selfsigned|self)
        generate_self_signed "${2:-localhost}" "${3:-365}"
        ;;
    letsencrypt|le|certbot)
        generate_letsencrypt "$2" "$3" "${4:-false}"
        ;;
    import)
        import_certificate "$2" "$3" "$4"
        ;;
    status|check)
        check_ssl_status
        ;;
    disable|off)
        disable_ssl
        ;;
    *)
        show_usage
        ;;
esac
