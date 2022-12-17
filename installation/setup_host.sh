sudo apt-get install openssh-server

sudo groupadd -r opc-hg
sudo useradd -r -m -g opc-hg opc-hu
sudo usermod -a -G sudo opc-hu
sudo chpasswd <<<"opc-hu:opc"