sudo apt-get install openssh-server

sudo useradd -r -m -g nogroup opc
sudo usermod -a -G sudo opc
sudo chpasswd <<<"opc:opc"