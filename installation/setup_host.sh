#!/bin/bash
apt-get install openssh-server

groupadd -r -g 50000 opc-hg
useradd -r -m -u 50000 -g opc-hg opc-hu
usermod -a -G sudo opc-hu
usermod -s /bin/sh opc-hu
chpasswd <<<"opc-hu:opchostuser"

groupadd opc-upg
