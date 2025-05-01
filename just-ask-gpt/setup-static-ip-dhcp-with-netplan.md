---
description: >-
  A step-by-step guide to configure network interfaces on Ubuntu using Netplan,
  including Static IP and DHCP examples.
---

# Setup Static IP / DHCP with Netplan

> 💡 The **Just Ask GPT** series is a collection of quick-reference notes created for my personal use or memorization. Each post includes only minimal explanations to highlight key concepts or procedures. If you are unfamiliar with the topic, simply ask GPT using the post title to get a more detailed explanation.

In short, modifying the config in `/etc/netplan` and then `sudo netplan apply` to apply it. This can be used to configure the static IP or DHCP on ubuntu.

1.  View all network interfaces on the machine

    ```bash
    ip link show
    ```
2. Netplan configuration files
   * Place at `/etc/netplan`
   * Configuration files are merged in lexical order.
   * To ensure the config are not overridden, name it starts with `00-`.
   *   Example: Static ip config

       ```yaml
       # /etc/netplan/00-installer-config.yaml
       network:
         ethernets:
           <interface>:           # shown in ip link, e.g. eth0
             addresses:
             - <ip>/<subnet>      # 192.168.1.100/24
             gateway4: <gateway>  # 192.168.1.254
         version: 2
       ```
   *   Example: DHCP config

       ```yaml
       # /etc/netplan/01-netcfg.yaml
       network:
         ethernets:
           <interface>:
               dhcp4: true
               dhcp6: false
         version: 2
       ```
3.  Apply the new configurations

    ```bash
    sudo netplan apply
    ```
4.  Check the current configuration

    ```bash
    sudo netplan get
    ```
