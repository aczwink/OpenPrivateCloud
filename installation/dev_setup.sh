sudo groupadd -r opc-controller-group
sudo useradd -r -m -g opc-controller-group opc-controller
sudo adduser opc-controller %YOUR_USERS_PRIMARY_GROUP% #TODO: insert your primary group here

#generate ssl
sudo mkdir /etc/OpenPrivateCloud
sudo chown opc-controller /etc/OpenPrivateCloud
sudo chmod 700 /etc/OpenPrivateCloud
sudo openssl req -x509 -nodes -days 365 -newkey rsa:4096 -keyout /etc/OpenPrivateCloud/private.key -out /etc/OpenPrivateCloud/public.crt
sudo chown opc-controller /etc/OpenPrivateCloud/private.key


#generate key pair for standard user
openssl genrsa -out keypair.pem 4096
openssl rsa -in keypair.pem -pubout -out publickey.crt
privateKey=`cat keypair.pem`
publicKey=`cat publickey.crt`
rm keypair.pem publickey.crt


#setup db
sudo apt install mariadb-server
sudo mysql -u root -p -e "CREATE DATABASE openprivatecloud;"
sudo mysql -u root -p -e "CREATE USER 'opc'@'localhost' IDENTIFIED BY 'opc'; GRANT ALL PRIVILEGES ON openprivatecloud.* TO 'opc'@'localhost'; FLUSH PRIVILEGES;"
sudo mysql -u root -p openprivatecloud < ../database/db.sql
sudo mysql -u root -p openprivatecloud < ../database/db_roledefinitions.sql
sudo mysql -u root -p -e "INSERT INTO openprivatecloud.users (emailAddress, firstName, privateKey, publicKey) VALUES ('<your email address>', 'root', '$privateKey', '$publicKey');" #TODO: insert your email here
sudo mysql -u root -p -e "INSERT INTO openprivatecloud.users_clientSecrets (userId, pwHash, pwSalt) VALUES (1, 'ea3925fcddd37ebcdaddf02f991f28b37debfb0ea677b5b2a532ce03628d9983', '00000000000000000000000000000000');" #standard pw is "root"

sudo -E sh -c 'echo "opc" > /etc/OpenPrivateCloud/dbpw'

#setup frontend
mkdir -p ../frontend/dist/
sudo cp /etc/OpenPrivateCloud/private.key ../frontend/dist/
sudo chmod 644 ../frontend/dist/private.key
sudo cp /etc/OpenPrivateCloud/public.crt ../frontend/dist/
