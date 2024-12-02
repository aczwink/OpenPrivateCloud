dbpw=`cat ./certs/dbpw`
sudo docker container exec opc-db mariadb-dump openprivatecloud -uopc -p$dbpw > ./dbbackups/$(date '+%Y-%m-%d').sql
