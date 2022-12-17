sudo apt update
sudo apt install unzip

sudo groupadd -r opc-controller-group
sudo useradd -r -m -g opc-controller-group opc-controller



#generate ssl
sudo mkdir /etc/OpenPrivateCloud
sudo chown opc-controller /etc/OpenPrivateCloud
sudo chmod 700 /etc/OpenPrivateCloud
sudo openssl req -x509 -nodes -days 365 -newkey rsa:4096 -keyout /etc/OpenPrivateCloud/private.key -out /etc/OpenPrivateCloud/public.crt
sudo chown opc-controller /etc/OpenPrivateCloud/private.key



#apache setup for frontend
sudo apt install apache2
sudo a2dissite 000-default.conf
sudo a2enmod ssl
sudo sh -c 'echo "Listen 8079" > "/etc/apache2/ports.conf"'

wget https://raw.githubusercontent.com/aczwink/OpenPrivateCloud/main/installation/apache2/openprivatecloud_frontend.conf
sudo mv ./openprivatecloud_frontend.conf /etc/apache2/sites-available/
sudo a2ensite openprivatecloud_frontend.conf

sudo mkdir /var/www/html/openprivatecloud_frontend

sudo systemctl reload apache2




#setup db
sudo apt install mariadb-server

sudo mysql -u root -p -e "CREATE DATABASE openprivatecloud;"

wget https://raw.githubusercontent.com/aczwink/OpenPrivateCloud/main/db.sql
sudo mysql -u root -p openprivatecloud < db.sql
rm db.sql

sudo mysql -u root -p -e "CREATE USER 'opc'@'localhost' IDENTIFIED BY 'opc'; GRANT ALL PRIVILEGES ON openprivatecloud.* TO 'opc'@'localhost'; FLUSH PRIVILEGES;"
sudo mysql -u root -p -e "INSERT INTO openprivatecloud.users (emailAddress, pwHash, pwSalt, sambaPW) VALUES ('<your email address>', 'ea3925fcddd37ebcdaddf02f991f28b37debfb0ea677b5b2a532ce03628d9983', '00000000000000000000000000000000', '');" #standard pw is "root"

export config="{
	\"database\": {
		\"userName\": \"opc\",
		\"password\": \"opc\"
	}
}"
sudo -E sh -c 'echo "$config" > /etc/OpenPrivateCloud/config.json'



#backend setup
sudo apt install nodejs npm
npm install ssh2



#install systemd units
wget https://raw.githubusercontent.com/aczwink/OpenPrivateCloud/main/installation/openprivatecloud.service

SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
absDirPath=$(realpath "$SCRIPTPATH/")
echo $absDirPath
sed -i -e "s:\\\$TARGETDIR\\\$:$absDirPath:g" openprivatecloud.service
sudo mv openprivatecloud.service /etc/systemd/system/

sudo systemctl enable openprivatecloud.service
sudo systemctl start openprivatecloud.service

wget https://raw.githubusercontent.com/aczwink/OpenPrivateCloud/main/installation/controller_update.sh
chmod +x controller_update.sh
./controller_update.sh