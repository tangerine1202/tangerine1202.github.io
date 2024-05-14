---
title: Setup a VNC Server
date: 2024-05-13 22:28:08
tags: 
- VNC 
- Xfce
- X11
- Unix-like
---


> This post is based on another tutorial “[How to Install and Configure VNC on Ubuntu 20.04 — DigitalOcean](https://www.digitalocean.com/community/tutorials/how-to-install-and-configure-vnc-on-ubuntu-20-04)” and provides additional information for more comprehensive understanding.

> Please note that this content has been modified based on my personal needs and may not retain every detail from the original source. It is recommended to also read the original tutorial!

## What is

+ **Xfce / Xfce4**
   - Xfce is a lightweight desktop environment.
   - Xfce and Xfce4 are effectively the same thing now. Xfce went through a major rewrite, labeled as Xfce 4.0.
+ **VNC server**
   - Virtual Network Computing (VNC) is a remote desktop sharing system. It allows users to remotely control and access another computer's desktop over a network connection.
+ **X / X11 Window System**
   - The X Window System is the underlying graphical system that provides low-level functionality for displaying graphical applications on Unix-like systems. 
   - X itself does not provide a complete desktop environment, but only the fundamental graphical infrastructure.
   - X can manage multiple display servers, specified by `DISPLAY=hostname:display_number.screen_number`. The display number `:0` is usually reserved for the primary display. For example, if you start a VNC server with `vncserver :1` and want to run a graphical application (e.g., `gedit`) on that display, you could do:
      ```shell
      export DISPLAY=:1 
      gedit
      ```

## General Steps

1. Install X Server (usually already built-in)
2. Install a desktop environment, e.g., Xfce
3. Install a VNC server
4. Configure the VNC server to use the chosen desktop environment (Xfce in this case)
5. Start the VNC server
6. Create a SSH tunnel to securely connect to the VNC desktop
7. Connect to the VNC desktop with a VNC client

### Install desktop environment and VNC server

1. Update apt package list

   ```shell
   sudo apt update
   ```
2. install the desktop environment

   ```shell
   sudo apt install xfce4 xfce4-goodies
   ```
   - `xfce4-goodies`: contains a few enhancements for the Xfce desktop environment.

3. Install the VNC server

   ```shell
   sudo apt install tightvncserver
   ```

4. Start the VNC server

   ```shell
   vncserver [:<display_num>] # display_num=1-99, default to 1
   ```

5. (Optional) Change the password of the VNC server

   ```shell
   vncpasswd
   ```

6. Close the VNC server, since we will modify the configuration later.

   ```shell
   vncserver -kill :<display_num>
   ```

### Configuring the VNC Server

The VNC server will start a new instance of X server session to isolate the remote desktop session from the local desktop session. After the session is started, the VNC server executes the configuration file to initialize the desktop environment, e.g. start the desktop environment, window manager, open graphical applications, etc. This configuration file is usually located at `$HOME/.vnc/xstartup`.

1. Modify the `$HOME/.vnc/xstartup` file

   ```bash
   #!/bin/bash
   xrdb $HOME/.Xresources
   startxfce4 &
   ```
   - `.Xresources`: Contains resource settings that can be customized for the X client application. 
   - `xrdb`: This command merges customized resource settings, e.g font settings, with the X server’s resources database.
   - `startxfce4` Starts the Xfce4 desktop environment.
   - `<cmd> &`: Runs `<cmd>` in the background.

2. Make it executable

   ```shell
   chmod +x ~/.vnc/xstartup
   ```

3. Restart the VNC server

   ```shell
   vncserver -localhost :<display_num>
   ```
   - `-localhost`: This option binds the VNC server to the loopback interface, which causes it to only be accessible from the localhost.
   - `:<display_num>`: The VNC server creates a new X display server and binds to the display number.

### Connect to the VNC desktop securely with a SSH tunnel

The VNC does not use secure protocols for connection. To securely connect to the server, we can connect to it through SSH tunnel.

1. Start the SSH tunnel
   ```shell
   ssh -L <client_port>:localhost:<vnc_port> -C <server_ip> 
   ```
   - `-L <client_port>:localhost:<vnc_port>`: The `-L` flag specifies the  port on the local compute (`<client_port>`) to be forward to the given host and port on the server (`localhost:<vnc_port>`).
   - `-C`: Enables compression, which helps minimize resource consumption and speed things up.
2. Use a VNC client to connect to `localhost:<client_port>`. On MacOS, you can use the built-in “Screen Sharing” app.

## TroubleShooting

+ Could not connect to display

   This error message is ambiguous. One possible reason is that it does not read the intended display number, as the primary display server run on `:0`, but VNC server usually run on `:1-99`.
   Export the `DISPLAY` environment variable and try again.
   ```shell
   export DISPLAY=:<display_num>
   # cmd you want to run on the display
   ```

+ `.Xresources` not found

   Run the `xrdb` command conditionally:
   ```bash
   if [ -f "$HOME/.Xresources" ]; then
       xrdb $HOME/.Xresources
   fi
   ```
   or just create a empty `.Xresouces` file as workaround.

+ Plugin "Power Manager Plugin" unexpectedly left the panel, do you want to restart it?

   I encountered this error when running in a container. As suggested [here](https://github.com/edgelevel/alpine-xfce-vnc?tab=readme-ov-file#known-issues), *The plugin doesn't work in the container due to a lack of power in docker, so this is not a bug but a limitation of docker.*