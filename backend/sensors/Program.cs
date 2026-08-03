using System.Text.Json;
using LibreHardwareMonitor.Hardware;

static IEnumerable<IHardware> Walk(IHardware hardware)
{
    yield return hardware;
    foreach (var child in hardware.SubHardware)
        foreach (var item in Walk(child))
            yield return item;
}

var computer = new Computer
{
    IsCpuEnabled = true,
    IsGpuEnabled = true,
    IsMemoryEnabled = true,
    IsMotherboardEnabled = true,
    IsStorageEnabled = true,
    IsControllerEnabled = true,
};

try
{
    computer.Open();
    while (true)
    {
        var sensors = new List<object>();
        foreach (var root in computer.Hardware)
        {
            foreach (var hardware in Walk(root))
            {
                hardware.Update();
                foreach (var sensor in hardware.Sensors)
                {
                    if (sensor.Value is null) continue;
                    var type = sensor.SensorType.ToString();
                    if (type is not ("Temperature" or "Fan" or "Load" or "SmallData" or "Data" or "Power" or "Clock")) continue;
                    sensors.Add(new
                    {
                        hardware = hardware.Name,
                        hardwareType = hardware.HardwareType.ToString(),
                        name = sensor.Name,
                        type,
                        value = Math.Round(sensor.Value.Value, 2),
                        identifier = sensor.Identifier.ToString(),
                    });
                }
            }
        }
        Console.WriteLine(JsonSerializer.Serialize(new { source = "LibreHardwareMonitor", sensors }));
        Console.Out.Flush();
        await Task.Delay(1000);
    }
}
catch (Exception error)
{
    Console.WriteLine(JsonSerializer.Serialize(new { source = "LibreHardwareMonitor", sensors = Array.Empty<object>(), error = error.Message }));
    Environment.ExitCode = 1;
}
finally
{
    computer.Close();
}
