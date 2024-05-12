sudo apt-get install openssh-server

sudo groupadd -r -g 50000 opc-hg
sudo useradd -r -m -u 50000 -g opc-hg opc-hu
sudo usermod -a -G sudo opc-hu
sudo usermod -s /bin/sh opc-hu
sudo chpasswd <<<"opc-hu:opchostuser"

sudo groupadd opc-upg
