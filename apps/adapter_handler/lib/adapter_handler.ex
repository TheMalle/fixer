defmodule AdapterHandler do
  # def child_spec(%{id: client_id, type: client_type, adapter: adapter_name, config: config} = _spec) do
  #   client = client(client_type)
  #   full_client_id = full_client_id(client_id)
  #   config = Map.put(config, :full_client_id, full_client_id)
  #   client.child_spec(adapter_name, config)
  # end

  def adapter(adapter_type, adapter_map) do
    adapter = Map.get(adapter_map, adapter_type, :error)

    if adapter == :error do
      raise ArgumentError, "unknown adapter type #{inspect(adapter_type)} for #{inspect("LABEL")} adapter"
    end

    unless Code.ensure_compiled?(adapter) do
      raise ArgumentError, "adapter #{inspect(adapter)} was not compiled, ensure it is correct and included as a project dependency"
    end

    adapter
  end

  def child_spec(%{adapter: adapter_name, config: config, global: global_config} = _spec, adapter_map) do
    child_spec(adapter_name, adapter_map, config, global_config)
  end

  def child_spec(adapter_type, adapter_map, child_config, extra_config \\ %{}) do
    config = Map.put(child_config, :global, extra_config)
    adapter = adapter(adapter_type, adapter_map)
    adapter.child_spec(config)
  end
    
  # defp full_id(client_type, client_id), do: Module.concat([client_id, adapter])
end
