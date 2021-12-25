defmodule Fixer.Discord.Struct.ApplicationCommand do
  alias Fixer.Discord.Struct.{ApplicationCommand, ApplicationCommandOption}

  defstruct [
    :id,
    :type,
    :application_id,
    :guild_id,
    :name,
    :description,
    :options,
    :default_permission,
    :version
  ]

  def from_map(map) do
    options =
      map
      |> Map.get(:options, [])
      |> Enum.map(&ApplicationCommandOption.from_map(&1))

    struct(%ApplicationCommand{}, map)
    |> Map.replace!(:options, options)
  end
end
