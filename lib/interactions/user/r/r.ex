defmodule Fixer.Interactions.User.R do
  alias Nostrum.Api
  alias Fixer.Parser

  @behaviour Fixer.Interactions.Interaction

  @impl Fixer.Interactions.Interaction
  def handle_new_interaction(interaction) do
    response =
      interaction
      |> Map.get(:data)
      |> Map.get(:options)
      |> Enum.find_value(&(Map.get(&1, :name) == "dicecode"), &Map.get(&1, :value))
      |> Parser.parse()
      |> Parser.interaction_response()
      |> Parser.insert_user_ping(interaction)

    Api.create_interaction_response(interaction, response)
    |> IO.inspect(label: "interaction server response")
  end
end
