./apache2/dev_setup.sh

sudo useradd -r -m -g nogroup opc-controller
sudo adduser opc-controller %YOUR_USERS_PRIMARY_GROUP%

#generate ssl
sudo mkdir /etc/OpenPrivateCloud
sudo chown opc-controller /etc/OpenPrivateCloud
sudo chmod 700 /etc/OpenPrivateCloud
sudo openssl req -x509 -nodes -days 365 -newkey rsa:4096 -keyout /etc/OpenPrivateCloud/private.key -out /etc/OpenPrivateCloud/public.crt
sudo chown opc-controller /etc/OpenPrivateCloud/private.key

#install systemd units
SCRIPTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
absDirPath=$(realpath "$SCRIPTPATH/../")/backend/dist
echo $absDirPath
sudo cp openprivatecloud.service /etc/systemd/system/
sudo sed -i -e "s:\\\$TARGETDIR\\\$:$absDirPath:g" /etc/systemd/system/openprivatecloud.service

sudo systemctl enable openprivatecloud.service
sudo systemctl start openprivatecloud.service
