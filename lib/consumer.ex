defmodule Fixer.Consumer do
  use Nostrum.Consumer

  require Logger

  alias Fixer.EventHandler

  def start_link do
    Consumer.start_link(__MODULE__)
  end

  def handle_event({type, _data, _ws_state} = event) do
    Logger.debug("Incoming event type: #{inspect(type)}")
    EventHandler.handle_event(event)
  end

  def handle_event(event) do
    Logger.warn("Unhandled event of unknown type: #{inspect(event)}")
    :noop
  end
end
