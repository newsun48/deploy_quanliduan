package com.projectmanagement.core_system.config;

import com.mongodb.client.MongoClient;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.config.AbstractMongoClientConfiguration;

@Configuration
public class MongoConfig extends AbstractMongoClientConfiguration {

    @Override
    protected String getDatabaseName() {
        return "project_management_db";
    }

    @Override
    public MongoClient mongoClient() {
        return com.mongodb.client.MongoClients.create("mongodb://localhost:27017");
    }
}
