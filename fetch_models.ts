import "dotenv/config";

async function main() {
  const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${process.env.VITE_NVIDIA_API_KEY}`
    }
  });
  const data = await res.json();
  if (data.data) {
    console.log(data.data.map((m: any) => m.id).filter((id: string) => id.includes('glm')));
  } else {
    console.log(data);
  }
}
main();
