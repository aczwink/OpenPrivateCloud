#generate ssl
mkdir certs
cd certs
openssl req -x509 -nodes -days 365 -newkey rsa:4096 -keyout ./private.key -out ./public.crt
cd ..

#prepare opc config
export config="{
	\"database\": {
		\"userName\": \"opc\",
		\"password\": \"opc\"
	}
}"
echo "$config" > ./certs/config.json

#prepare database dump for import
mkdir dbimport
cd dbimport
#the following line will get the standard db. You can use your backup instead
wget https://raw.githubusercontent.com/aczwink/OpenPrivateCloud/main/db.sql
#insert your email address, standard pw is "root"
echo "INSERT INTO openprivatecloud.users (emailAddress, firstName, privateKey, publicKey) VALUES ('<your email address>', 'root', '', '');" > user.sql
echo "INSERT INTO openprivatecloud.users_clientSecrets (userId, pwHash, pwSalt) VALUES (1, 'ea3925fcddd37ebcdaddf02f991f28b37debfb0ea677b5b2a532ce03628d9983', '00000000000000000000000000000000');" >> user.sql
cd ..

#start services
wget https://raw.githubusercontent.com/aczwink/OpenPrivateCloud/main/installation/docker-compose.yml
docker-compose up