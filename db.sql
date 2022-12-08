-- MariaDB dump 10.19  Distrib 10.6.7-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: openprivatecloud
-- ------------------------------------------------------
-- Server version	10.6.7-MariaDB-2ubuntu1.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `cluster_configuration`
--

DROP TABLE IF EXISTS `cluster_configuration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cluster_configuration` (
  `configKey` varchar(100) NOT NULL,
  `value` text NOT NULL,
  PRIMARY KEY (`configKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `hosts`
--

DROP TABLE IF EXISTS `hosts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `hosts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `hostName` varchar(200) NOT NULL,
  `password` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `hosts_health`
--

DROP TABLE IF EXISTS `hosts_health`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `hosts_health` (
  `hostId` int(10) unsigned NOT NULL,
  `status` tinyint(3) unsigned NOT NULL,
  `log` text NOT NULL,
  PRIMARY KEY (`hostId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `hosts_storages`
--

DROP TABLE IF EXISTS `hosts_storages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `hosts_storages` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `hostId` int(10) unsigned NOT NULL,
  `path` varchar(200) NOT NULL,
  `fileSystemType` varchar(5) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `hosts_storages_hostId` (`hostId`),
  CONSTRAINT `hosts_storages_hostId` FOREIGN KEY (`hostId`) REFERENCES `hosts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `instances`
--

DROP TABLE IF EXISTS `instances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `instances` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `fullName` varchar(200) NOT NULL,
  `storageId` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fullName` (`fullName`),
  KEY `instances_storageId` (`storageId`),
  CONSTRAINT `instances_storageId` FOREIGN KEY (`storageId`) REFERENCES `hosts_storages` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `instances_configuration`
--

DROP TABLE IF EXISTS `instances_configuration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `instances_configuration` (
  `instanceId` int(10) unsigned NOT NULL,
  `config` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (`instanceId`),
  CONSTRAINT `instance_configuration_instanceId` FOREIGN KEY (`instanceId`) REFERENCES `instances` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `instances_health`
--

DROP TABLE IF EXISTS `instances_health`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `instances_health` (
  `instanceId` int(10) unsigned NOT NULL,
  `status` tinyint(3) unsigned NOT NULL,
  `availabilityLog` text NOT NULL,
  `lastSuccessfulCheck` datetime NOT NULL,
  `checkLog` text NOT NULL,
  PRIMARY KEY (`instanceId`),
  CONSTRAINT `instances_health_instanceId` FOREIGN KEY (`instanceId`) REFERENCES `instances` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `instances_logs`
--

DROP TABLE IF EXISTS `instances_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `instances_logs` (
  `logId` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `instanceId` int(10) unsigned NOT NULL,
  `startTime` datetime NOT NULL,
  `endTime` datetime NOT NULL,
  `title` text NOT NULL,
  `status` tinyint(3) unsigned NOT NULL,
  `log` text NOT NULL,
  PRIMARY KEY (`logId`),
  KEY `instances_logs_instanceId` (`instanceId`),
  CONSTRAINT `instances_logs_instanceId` FOREIGN KEY (`instanceId`) REFERENCES `instances` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `instances_permissions`
--

DROP TABLE IF EXISTS `instances_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `instances_permissions` (
  `instanceId` int(10) unsigned NOT NULL,
  `userGroupId` int(10) unsigned NOT NULL,
  `permission` varchar(200) NOT NULL,
  KEY `instance_permissions_instanceId` (`instanceId`),
  KEY `instance_permissions_userGroupId` (`userGroupId`),
  CONSTRAINT `instance_permissions_instanceId` FOREIGN KEY (`instanceId`) REFERENCES `instances` (`id`),
  CONSTRAINT `instance_permissions_userGroupId` FOREIGN KEY (`userGroupId`) REFERENCES `usergroups` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `usergroups`
--

DROP TABLE IF EXISTS `usergroups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `usergroups` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `usergroups_members`
--

DROP TABLE IF EXISTS `usergroups_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `usergroups_members` (
  `groupId` int(10) unsigned NOT NULL,
  `userId` int(10) unsigned NOT NULL,
  PRIMARY KEY (`groupId`,`userId`),
  KEY `usergroups_members_userId` (`userId`),
  CONSTRAINT `usergroups_members_groupId` FOREIGN KEY (`groupId`) REFERENCES `usergroups` (`id`),
  CONSTRAINT `usergroups_members_userId` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `emailAddress` varchar(200) NOT NULL,
  `pwHash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `pwSalt` char(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `sambaPW` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2022-12-09  0:38:02
