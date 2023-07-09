cp frontend/static/index.htm frontend/dist/
zip -9 opc-release.zip backend/dist/bundle.js frontend/dist/bundle.js frontend/dist/index.htm
rm frontend/dist/index.htm