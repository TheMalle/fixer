defmodule Fixer.EventHandler do
  require Logger


  def handle_event({type, _data, _ws_state}) do
    Logger.warn("Unhandled event type: #{inspect(type)}")
    :noop
  end
end
