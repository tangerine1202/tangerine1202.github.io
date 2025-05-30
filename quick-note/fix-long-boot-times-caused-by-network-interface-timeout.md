---
description: >-
  Resolve Ubuntu's slow boot issue when systemd-networkd-wait-online.service
  times out waiting for network connections, with solutions including Netplan
  and service configurations.
---

# Fix Long Boot Times Caused by Network Interface Timeout

## Error log

```bash
May 28 20:00:15 hostname systemd-networkd-wait-online[1046]: Timeout occurred while waiting for network connectivity.
May 28 20:00:15 hostname systemd[1]: systemd-networkd-wait-online.service: Main process exited, code=exited, status=1/FAILURE
May 28 20:00:15 hostname systemd[1]: systemd-networkd-wait-online.service: Failed with result 'exit-code'.
May 28 20:00:15 hostname systemd[1]: Failed to start systemd-networkd-wait-online.service - Wait for Network to be Configured.##
```

## Description

During boot, the system waits 120 seconds for the network interface to connect, potentially causing a long boot time if some networks aren't required at startup.

## Solutions

### 1. Netplan

Netplan is Ubuntu’s network manager, providing a single source to control network settings. It is a good idea to configure here.

We can assign the interface to be optional and apply the changes.

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      ...
      optional: true
```

```bash
sudo netplan apply
```

### 2. Edit `systemd-networkd-wait-online.service`

This method provides fine-grained control about what interfaces to wait for during startup.

To edit the service, run `sudo systemctl edit systemd-networkd-wait-online.service`.

We can set the timeout with the `--timeout` option, default is 120 seconds.

```bash
[Service] 
ExecStart= 
ExecStart=/usr/lib/systemd/systemd-networkd-wait-online --timeout=10 # inline option
# TimeoutSec=10
```

`—-any` waits for any one interface to connect rather than all interfaces.

```bash
[Service]
ExecStart=
ExecStart=/usr/lib/systemd/systemd-networkd-wait-online --any
```

`—-interface=` specifies which interface to wait for and ignore others.

```bash
[Service]
ExecStart=
ExecStart=/usr/lib/systemd/systemd-networkd-wait-online --interface=eth0
```

`—-ignore=` ignores the specific interface.

```bash
[Service]
ExecStart=
ExecStart=/usr/lib/systemd/systemd-networkd-wait-online --ignore=eth0
```

**Note**: the `sudo systemctl edit …` command will create a override file at `/etc/systemd/system/systemd-networkd-wait-online.service.d/override.conf`.

### 3. Disable `systemd-networkd-wait-online.service`

Disable the service will prevent waiting for any interface during boot time.

```bash
sudo systemctl disable systemd-networkd-wait-online.service
```

```bash
sudo systemctl mask systemd-networkd-wait-online.service
# sudo systemctl unmask systemd-networkd-wait-online.service
```

**Note**: `disable` does not prevent other services to trigger it to start. `mask` prevents it from being started by setting the symbolic link to `/dev/null` and can be reversed with `unmask`

## References

* [https://www.baeldung.com/linux/systemd-networkd-wait-online-service-timeout-solution](https://www.baeldung.com/linux/systemd-networkd-wait-online-service-timeout-solution)
