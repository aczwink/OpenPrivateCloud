download_latest_release()
{
	wget https://api.github.com/repos/aczwink/$1/releases/latest -O - | awk -F \" -v RS="," '/browser_download_url/ {print $(NF-1)}' | xargs wget
}

download_latest_release OpenPrivateCloud
unzip opc-release.zip
rm opc-release.zip
sudo mv frontend/dist/* /var/www/html/openprivatecloud_frontend/
rm -rf frontend

mv backend/dist/bundle.js ./opc-backend.js
rm -rf backend

download_latest_release ACTS-Util
sudo mv acts-util-core.js /var/www/html/openprivatecloud_frontend/

download_latest_release ACFrontEnd
sudo mv acfrontend.js /var/www/html/openprivatecloud_frontend/
rm clean.css

sudo systemctl restart openprivatecloud.service