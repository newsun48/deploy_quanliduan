package com.projectmanagement.core_system.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
@Controller
@RequestMapping("/home-old")
public class HomeController {

    @GetMapping
    public String home() {
        return "home";
    }
}
