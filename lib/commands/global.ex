defmodule Fixer.Commands.Command.Global do
  alias Nostrum.Api
  alias Fixer.Discord.Struct.ApplicationCommand

  require Logger

  def apply_command_action(:create, %{name: name} = command) do
    case Api.create_global_application_command(command) do
      {:ok, _command_spec} ->
        Logger.info("Created global application command: #{inspect(name)}")

      {:error, error_data} ->
        Logger.error("Failed to create global application command: #{inspect(name)}")
        Logger.debug("Error data: #{inspect(error_data)}")
    end
  end

  def apply_command_action({:update, command_id}, %{name: name} = command) do
    case Api.edit_global_application_command(command_id, command) do
      {:ok, _command_spec} ->
        Logger.info("Updated global application command: #{inspect(name)}")

      {:error, error_data} ->
        Logger.error("Failed to update global application command: #{inspect(name)}")
        Logger.debug("Error data: #{inspect(error_data)}")
    end
  end

  def apply_command_action(:noop, %{name: name} = _command) do
    Logger.debug("Taking no action for global application command: #{inspect(name)}")
  end

  def conformance_action(%ApplicationCommand{name: name} = command_spec) do
    {:ok, existing_commands} = Api.get_global_application_commands()

    existing_commands
    |> Enum.find(&(Map.get(&1, :name) == name))
    |> compare(command_spec)
    |> case do
      :create ->
        Logger.warn("Global application command #{inspect(name)} not found")
        :create

      {:update, id} ->
        Logger.warn("Global application command #{inspect(name)} does not match server version")
        {:update, id}

      :noop ->
        Logger.debug("Global application command #{inspect(name)} matches server version")
        :noop
    end
  end

  defp compare(nil, command_spec), do: :create

  defp compare(%{id: id} = existing_command, command_spec) do
    existing_command
    |> ApplicationCommand.from_map()
    |> MapDiff.diff(command_spec)
    |> do_compare()
    |> case do
      true -> :noop
      false -> {:update, id}
    end
  end

  #   # IO.inspect(existing_command, label: "existing_command")
  #   # IO.inspect(ApplicationCommand.from_map(existing_command), label: "existing_command as struct")
  #   # IO.inspect(command_spec, label: "command_spec")
  #   # # MapDiff.diff(existing_command, command_spec)
  #   # # |> IO.inspect(label: "MapDiff")
  #   :noop
  # end

  defp do_compare(%{changed: :map_change, value: value} = _map_diff) do
    Enum.all?(value, &evaluate_value_change/1)
  end

  defp do_compare(%{changed: :equal} = _map_diff), do: true
  defp do_compare(%{changed: :primitive_change, added: nil} = _map_diff), do: true
  defp do_compare(_map_diff), do: false

  defp evaluate_value_change({_key, %{changed: :equal}}), do: true
  defp evaluate_value_change({_key, %{changed: :primitive_change, added: nil}}), do: true

  defp evaluate_value_change(
         {:options,
          %{
            changed: :primitive_change,
            added: [_ha | _ta] = added,
            removed: [_hr | _tr] = removed
          }}
       ) do
    Enum.zip(removed, added)
    |> Enum.all?(fn {a, r} ->
      MapDiff.diff(a, r)
      |> do_compare()
    end)
  end

  defp evaluate_value_change({_key, _changes} = diff), do: false
end
