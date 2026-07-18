<!-- PROJECT LOGO -->
<br />
<div align="center">
	<a href="https://github.com/LoneDestroyer/Userscripts/tree/main/userscripts/Steam-License-Load-All">
		<img src="https://steamcommunity.com/favicon.ico" alt="Steam Logo" width="100" height="100">
	</a>

<h3 align="center">Steam License - Load All</h3>

<p align="center"><strong>
    Loads all additional Steam license pages. (Due to Steam limiting to 100 per page)
  </strong></p>
</div>


<p align="center">
	<a href="https://raw.githubusercontent.com/LoneDestroyer/Userscripts/main/userscripts/Steam-License-Load-All/script.user.js"><img src="https://img.shields.io/badge/Install-28A745?style=flat&logo=github" alt="Install Userscript"></a>
</p>

<!-- Features -->
## Features
- Loads all additional license pages from the Steam account licenses page
- Adaptive slowdown and retry logic on HTTP 429, 500, and 503 responses
- Pause/stop controls with resume behavior
- Maintains the SteamDB column on newly loaded rows

<!-- Install Help -->
## Installation
> [!IMPORTANT]
> Chromium browsers must enable Developer mode under `Settings > Extensions` to run UserScript Managers

#### Step 1: ScriptManager
* [Tampermonkey](https://www.tampermonkey.net/)
* [Violentmonkey](https://violentmonkey.github.io/)

#### Step 2: UserScript
* <a href="https://raw.githubusercontent.com/LoneDestroyer/Userscripts/main/userscripts/Steam-License-Load-All/script.user.js"><img src="https://img.shields.io/badge/Install-28A745?style=flat&logo=github" alt="Install Userscript"></a>

## Usage
1. Go to `https://store.steampowered.com/account/licenses`
2. Start the script from your UserScript manager
3. Use pause/stop as needed, then resume to continue
