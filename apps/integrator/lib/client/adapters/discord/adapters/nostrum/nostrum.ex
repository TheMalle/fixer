defmodule Integrator.Client.Adapters.Discord.Adapters.Nostrum do
  @moduledoc false

  @behaviour AdapterHandler.Adapter
  @behaviour Integrator.Client.Adapters.Discord.Adapter
  
  alias Integrator.Client.Adapters.Discord.Adapters.Nostrum
  
  @impl AdapterHandler.Adapter
  def child_spec(%{global: global} = config) do
    [
      %{
        id: Map.fetch!(global, :id),
        start: {Nostrum.Server, :start_link, [config]}
      }
    ]
  end

end
