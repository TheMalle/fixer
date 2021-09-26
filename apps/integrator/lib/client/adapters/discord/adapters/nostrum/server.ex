defmodule Integrator.Client.Adapters.Discord.Adapters.Nostrum.Server do
  @moduledoc false
  
  use GenServer

  defmodule State do
    @moduledoc false

    defstruct [
      opts: %{}
    ]
  end
  
  def start_link(config \\ %{}) do
    {start_opts, state_opts} = Map.split(config, [:genserver])
    start_opts =
      start_opts
      |> Map.get(:genserver, %{})
      |> start_opts()
    
    state = %State{
      opts: state_opts
    }

    GenServer.start(__MODULE__, state, start_opts)
  end

  defp start_opts(config_map) do
    {start_opts, rem} = 
      config_map
      |> Enum.reject(fn {_,v} -> is_nil(v) or v=="" end)
      |> Keyword.split([:debug, :name, :timeout, :spawn_opt, :hibernate_after])
    
    unless rem == [] do
      raise ArgumentError, "invalid parameters in nostrum server configuration - unknown keys: #{inspect(Keyword.keys(rem))}"
    end
    
    start_opts
  end

  @impl GenServer
  def init(%State{} = state), do: {:ok, state}
end
