sudo mysqldump openprivatecloud --no-data | sed 's/ AUTO_INCREMENT=[0-9]*\b//'  > db.sql
sudo mysqldump openprivatecloud roles roles_permissions --no-create-info > db_roledefinitions.sql
