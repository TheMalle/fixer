defmodule Fixer.EventHandler do
  require Logger

  alias Fixer.Commands

  def handle_event({:READY, _msg, _ws_state}), do: Fixer.Commands.ensure_global_commands()

  def handle_event({:INTERACTION_CREATE, interaction, _ws_state}) do
    Fixer.Interactions.handle_new_interaction(interaction)
  end

  def handle_event({type, _data, _ws_state}) do
    Logger.warn("Unhandled event type: #{inspect(type)}")
    :noop
  end
end
