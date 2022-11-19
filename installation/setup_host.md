# General setup
- Set hostname
- Then create entries in fstab for storages
Entries should look like this:
UUID=<the UUID of the partition. Get it via blkid> /mnt/<storage name> auto defaults,noatime 0 0


# Special for Raspberry Pi
Run sudo raspi-config for general setup of the device

Disable Bluetooth:
sudo sh -c "echo 'dtoverlay=disable-bt' >> /boot/config.txt"

Disable Wifi:
sudo sh -c "echo 'dtoverlay=disable-wifi' >> /boot/config.txt"