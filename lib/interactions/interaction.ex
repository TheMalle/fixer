defmodule Fixer.Interactions.Interaction do
  @doc """
  Handle a new interaction.
  """
  @callback handle_new_interaction(%Nostrum.Struct.Interaction{}) :: :ok | {:error, String.t()}
end
