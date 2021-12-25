defmodule Fixer.Interactions.Message.RepeatRoll do
  alias Nostrum.Api
  alias Fixer.Parser

  @behaviour Fixer.Interactions.Interaction

  @impl Fixer.Interactions.Interaction
  def handle_new_interaction(interaction) do
    # TODO: Implement this to roll again
    response = %Fixer.Discord.Struct.InteractionResponse{
      type: 6,
      data: nil
    }

    Api.create_interaction_response(interaction, response)
  end
end
