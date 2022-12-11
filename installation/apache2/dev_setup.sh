SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
PATH_TO_FRONT_END=$(realpath "$SCRIPTPATH/../../frontend")

sudo apt install apache2
sudo a2enmod ssl

sudo ln -sf "$PATH_TO_FRONT_END/dist" /var/www/html/openprivatecloud_frontend
sudo ln -sf "$SCRIPTPATH/openprivatecloud_frontend.conf" /etc/apache2/sites-available/
sudo a2ensite openprivatecloud_frontend.conf
sudo systemctl reload apache2

sudo adduser www-data %YOUR_USERS_PRIMARY_GROUP%
