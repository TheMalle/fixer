defmodule Fixer.Interactions do
  alias Nostrum.Struct.Interaction

  require Logger

  @interaction_type_chat_input 1
  @interaction_type_user 2
  @interaction_type_message 3

  def handle_new_interaction(%{type: type} = interaction) do
    with {:ok, interaction_adapter} <- adapter(interaction),
         {:ok} <- interaction_adapter.handle_new_interaction(interaction) do
      :ok
    else
      {:error, :not_implemented} ->
        Logger.warn("Support for interaction of type id #{inspect(type)} is not yet implemented")
      {:error, error_data} ->
	Logger.warn("Failed to handle interaction: #{inspect(error_data)}")
    end
  end

  defp adapter(%{type: @interaction_type_user} = interaction) do
    module_name =
      interaction
      |> Map.get(:data)
      |> Map.get(:name)
      |> Macro.camelize()

    module = Module.safe_concat([Fixer.Interactions.User, module_name])
    {:ok, module}
  end

  defp adapter(%{type: @interaction_type_user} = interaction) do
    {:error, :not_implemented}
  end

  defp adapter(%{type: @interaction_type_message} = interaction) do
    module_name =
      interaction
      |> Map.get(:data)
      |> Map.get(:custom_id)
      |> Macro.camelize()

    module = Module.safe_concat([Fixer.Interactions.Message, module_name])
    {:ok, module}
  end
end
