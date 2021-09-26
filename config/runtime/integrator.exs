import Config

config :integrator,
  clients: [
    %{
      global: %{
        id: "discord_bot_a"
      },
      adapter: :discord,
      config: %{
        adapter: :nostrum,
        config: %{
          genserver: [
            debug: nil,
            name: nil,
            timeout: nil,
            spawn_opt: nil,
            hibernate_after: nil
          ],
          token: "123"
        }
      }
    }
  ]
