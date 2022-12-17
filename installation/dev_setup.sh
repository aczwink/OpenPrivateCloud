./apache2/dev_setup.sh

sudo groupadd -r opc-controller-group
sudo useradd -r -m -g opc-controller-group opc-controller
sudo adduser opc-controller %YOUR_USERS_PRIMARY_GROUP%

#generate ssl
sudo mkdir /etc/OpenPrivateCloud
sudo chown opc-controller /etc/OpenPrivateCloud
sudo chmod 700 /etc/OpenPrivateCloud
sudo openssl req -x509 -nodes -days 365 -newkey rsa:4096 -keyout /etc/OpenPrivateCloud/private.key -out /etc/OpenPrivateCloud/public.crt
sudo chown opc-controller /etc/OpenPrivateCloud/private.key


#setup db
sudo mysql -u root -p -e "CREATE DATABASE openprivatecloud;"
sudo mysql -u root -p -e "CREATE USER 'opc'@'localhost' IDENTIFIED BY 'opc'; GRANT ALL PRIVILEGES ON openprivatecloud.* TO 'opc'@'localhost'; FLUSH PRIVILEGES;"
sudo mysql -u root -p openprivatecloud < ../db.sql
sudo mysql -u root -p -e "INSERT INTO openprivatecloud.users (emailAddress, pwHash, pwSalt, sambaPW) VALUES ('<your email address>', 'ea3925fcddd37ebcdaddf02f991f28b37debfb0ea677b5b2a532ce03628d9983', '00000000000000000000000000000000', '');" #standard pw is "root"

export config="{
	\"database\": {
		\"userName\": \"opc\",
		\"password\": \"opc\"
	}
}"
sudo -E sh -c 'echo "$config" > /etc/OpenPrivateCloud/config.json'

#install systemd units
SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
absDirPath=$(realpath "$SCRIPTPATH/../")/backend/dist
echo $absDirPath
sudo cp openprivatecloud.service /etc/systemd/system/
sudo sed -i -e "s:\\\$TARGETDIR\\\$:$absDirPath:g" /etc/systemd/system/openprivatecloud.service

sudo systemctl enable openprivatecloud.service
sudo systemctl start openprivatecloud.service
