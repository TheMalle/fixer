defmodule Fixer.Discord.Struct.ApplicationCommandOption do
  alias Fixer.Discord.Struct.ApplicationCommandOption

  defstruct [
    :type,
    :name,
    :description,
    :required,
    :choices,
    :options,
    :channel_types,
    :min_value,
    :max_value,
    :autocomplete
  ]

  def from_map(map) do
    options =
      map
      |> Map.get(:options, [])
      |> Enum.map(&ApplicationCommandOption.from_map(&1))

    struct(%ApplicationCommandOption{}, map)
    |> Map.replace!(:options, options)
  end
end
