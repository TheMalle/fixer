defmodule Fixer.Commands.Command.Global.R do
  alias Fixer.Discord.Struct.{ApplicationCommand, ApplicationCommandOption}
  alias Fixer.Commands.Command
  alias Nostrum.Api

  @behaviour Command

  @impl Command
  def ensure(_opts \\ %{}) do
    command = %ApplicationCommand{
      name: "r",
      description: "Roll some dice, with support for the current game (if any)",
      options: [
        %ApplicationCommandOption{
          type: 3,
          name: "dicecode",
          description: "What do you want to roll?",
          required: true
        }
      ]
    }

    Command.Global.conformance_action(command)
    |> Command.Global.apply_command_action(command)
  end
end
