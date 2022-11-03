# General setup
- Set hostname

# Special for Raspberry Pi
Run sudo raspi-config for general setup of the device

Disable Bluetooth:
sudo sh -c "echo 'dtoverlay=disable-bt' >> /boot/config.txt"

Disable Wifi:
sudo sh -c "echo 'dtoverlay=disable-wifi' >> /boot/config.txt"