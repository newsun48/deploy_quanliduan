package com.projectmanagement.core_system.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    @GetMapping(value = {"/", "/login", "/register", "/dashboard","/admin/**","/signup","/manager","/manager/**","/profile","/employee"})
    public String forwardStaticRoutes() {
        return "forward:/index.html";
    }
}
