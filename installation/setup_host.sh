sudo apt-get install openssh-server

sudo useradd -r -m -g nogroup opc
sudo chpasswd <<<"opc:opc"