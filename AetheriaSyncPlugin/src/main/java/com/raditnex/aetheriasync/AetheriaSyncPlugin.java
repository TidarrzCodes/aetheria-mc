package com.raditnex.aetheriasync;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class AetheriaSyncPlugin extends JavaPlugin implements Listener, CommandExecutor {

    private static final String WORKER_URL = "https://aetheria-checkout.raditnur216531.workers.dev/?action=update_player_db";
    private static final String PREFIX = ChatColor.translateAlternateColorCodes('&', "&8[&eAetheria&8] &f");

    @Override
    public void onEnable() {
        // Register Events & Commands
        getServer().getPluginManager().registerEvents(this, this);
        if (getCommand("syncme") != null) {
            getCommand("syncme").setExecutor(this);
        }

        getLogger().info("AetheriaSync Plugin v1.0.0 (Spigot/Paper 1.20.1) Enabled!");

        // Auto Sync setiap 15 menit (18000 ticks)
        Bukkit.getScheduler().runTaskTimerAsynchronously(this, () -> {
            for (Player player : Bukkit.getOnlinePlayers()) {
                sendPlayerSyncData(player);
            }
        }, 18000L, 18000L);
    }

    @Override
    public void onDisable() {
        getLogger().info("AetheriaSync Plugin Disabled!");
    }

    @EventHandler
    public void onPlayerQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        // Sync data player secara asynchronous saat leave server
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> sendPlayerSyncData(player));
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (command.getName().equalsIgnoreCase("syncme") || command.getName().equalsIgnoreCase("syncdata")) {
            if (!(sender instanceof Player)) {
                sender.sendMessage("Perintah ini hanya dapat dijalankan oleh player in-game.");
                return true;
            }

            Player player = (Player) sender;
            player.sendMessage(PREFIX + ChatColor.GRAY + "Menghubungkan ke Cloudflare Worker & Google Sheets...");

            Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
                boolean success = sendPlayerSyncData(player);
                Bukkit.getScheduler().runTask(this, () -> {
                    if (success) {
                        player.sendMessage(PREFIX + ChatColor.GREEN + "Data profil, uang, & inventori berhasil disinkronkan ke Spreadsheet!");
                    } else {
                        player.sendMessage(PREFIX + ChatColor.RED + "Gagal menghubungkan ke Cloudflare Worker.");
                    }
                });
            });
            return true;
        }
        return false;
    }

    private boolean sendPlayerSyncData(Player player) {
        try {
            String username = player.getName();
            String ipAddress = player.getAddress() != null && player.getAddress().getAddress() != null 
                    ? player.getAddress().getAddress().getHostAddress() 
                    : "127.0.0.1";

            // Escape string JSON
            String jsonPayload = String.format(
                    "{\"username\":\"%s\",\"ipAddress\":\"%s\"}",
                    escapeJson(username),
                    escapeJson(ipAddress)
            );

            URL url = new URL(WORKER_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; utf-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonPayload.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int responseCode = conn.getResponseCode();
            conn.disconnect();
            return responseCode == 200;

        } catch (Exception e) {
            getLogger().warning("Gagal mengirim sync data player " + player.getName() + ": " + e.getMessage());
            return false;
        }
    }

    private String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\b", "\\b")
                    .replace("\f", "\\f")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r")
                    .replace("\t", "\\t");
    }
}
