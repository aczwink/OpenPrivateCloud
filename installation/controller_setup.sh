#generate ssl
mkdir certs
cd certs
openssl req -x509 -nodes -days 365 -newkey rsa:4096 -keyout ./private.key -out ./public.crt
cd ..

#set a good password for accessing the database ;)
echo "opc" > ./certs/dbpw

#generate key pair for standard user
openssl genrsa -out keypair.pem 4096
openssl rsa -in keypair.pem -pubout -out publickey.crt
privateKey=`cat keypair.pem`
publicKey=`cat publickey.crt`
rm keypair.pem publickey.crt

#prepare database dump for import
mkdir dbimport
cd dbimport
#the following line will get the standard db. You can use your backup instead
wget https://raw.githubusercontent.com/aczwink/OpenPrivateCloud/main/db.sql
#in case of a new setup you need a user. skip these steps if you are importing a backup
mail="<your email address>" #insert your email address, standard pw is "root"
echo "INSERT INTO openprivatecloud.users (emailAddress, firstName, privateKey, publicKey) VALUES ('$mail', 'root', '$privateKey', '$publicKey');" > user.sql
echo "INSERT INTO openprivatecloud.users_clientSecrets (userId, pwHash, pwSalt) VALUES (1, 'ea3925fcddd37ebcdaddf02f991f28b37debfb0ea677b5b2a532ce03628d9983', '00000000000000000000000000000000');" >> user.sql
cd ..

#start services
wget https://raw.githubusercontent.com/aczwink/OpenPrivateCloud/main/installation/docker-compose.yml
docker-compose up
