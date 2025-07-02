FROM php:8.2-apache-alpine

# Install required packages and PHP extensions
RUN apk add --no-cache \
    libxml2-dev \
    && docker-php-ext-install xml \
    && rm -rf /var/cache/apk/*

# Security configurations
RUN sed -i 's/^ServerTokens OS/ServerTokens Prod/' /etc/apache2/httpd.conf \
    && sed -i 's/^ServerSignature On/ServerSignature Off/' /etc/apache2/httpd.conf \
    && echo "ServerName localhost" >> /etc/apache2/httpd.conf

# Enable Apache modules
RUN sed -i 's/#LoadModule rewrite_module/LoadModule rewrite_module/' /etc/apache2/httpd.conf

# Copy application files from root
COPY index.php alerts.php /var/www/html/

# Set strict permissions
RUN chmod -R 755 /var/www/html \
    && chmod -R 644 /var/www/html/*.php

# Use non-root user
USER www-data

EXPOSE 80

CMD ["httpd-foreground"]