import * as THREE from 'three';
import { BuildingType } from './buildings/buildingType.js';
import { createBuilding } from './buildings/buildingFactory.js';
import { Tile } from './tile.js';
import { VehicleGraph } from './vehicles/vehicleGraph.js';
import { SimService } from './services/simService.js';

export class City extends THREE.Group {
  /**
   * Grupo separado para organizar meshes de depuração
   * para que não sejam incluídas em verificações de raycasting
   * @type {THREE.Group}
   */
  debugMeshes = new THREE.Group();
  
  /**
   * Nó raiz para todos os objetos da cena
   * @type {THREE.Group}
   */
  root = new THREE.Group();
  
  /**
   * Lista de serviços disponíveis na cidade
   * @type {SimService[]}
   */
  services = [];
  
  /**
   * Tamanho da cidade em ladrilhos
   * @type {number}
   */
  size = 6;
  
  /**
   * Tempo atual da simulação
   */
  simTime = 0;
  
  /**
   * Matriz 2D representando os blocos da cidade
   * @type {Tile[][]}
   */
  tiles = [];
  
  /**
   * Grafo de veículos para gerenciar conexões e rotas
   * @type {VehicleGraph}
   */
  vehicleGraph;

  /**  
   * Nível das missões
  **/
  level = 1;
  missionCounter = 0;
  levels = {
    [1]: {
      [1]: {mission: "Obtem 35 Residentes", citizens: 35, done: false},
      [2]: {mission: "5 Edifícios Construidos", buildings: 5, done: false},
      [3]: {mission: "Ter Pelo Menos 1 Rua", road: 1, done: false}
    },
    [2]: {
      [1]: {mission: "Obtem 75 Residentes", citizens: 75, done: false},
      [2]: {mission: "10 Edifícios Construidos", buildings: 10, done: false},
      [3]: {mission: "Ter Pelo Menos 5 Ruas", road: 5, done: false} 
    }
  };

  // Construtor da cidade
  constructor(size, money, name = 'Patal & oSLaYN City') {
    super(); // Inicializa a classe pai (THREE.Group)

    this.name = name;
    this.size = size;
    this.money = money;
    
    this.add(this.debugMeshes); // Adiciona meshes de depuração
    this.add(this.root);        // Adiciona o nó raiz

    // Cria a matriz de tiles (blocos da cidade)
    this.tiles = [];
    for (let x = 0; x < this.size; x++) {
      const column = [];
      for (let y = 0; y < this.size; y++) {
        const tile = new Tile(x, y); // Cria cada tile
        tile.refreshView(this);     // Atualiza a visualização do tile
        this.root.add(tile);        // Adiciona ao nó raiz
        column.push(tile);          // Adiciona o tile à coluna
      }
      this.tiles.push(column);      // Adiciona a coluna à matriz
    }

    this.services = []; // Inicializa a lista de serviços

    // Inicializa o grafo de veículos
    this.vehicleGraph = new VehicleGraph(this.size);
    this.debugMeshes.add(this.vehicleGraph); // Adiciona ao grupo de depuração
  }

  /**
   * Retorna a população total da cidade
   * @type {number}
   */
  get population() {
    let population = 0;
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.getTile(x, y);
        population += tile.building?.residents?.count ?? 0; // Soma a população de cada tile
      }
    }
    return population;
  }

  /**
   * Retorna o tile nas coordenadas especificadas.
   * Se estiver fora dos limites, retorna `null`.
   * @param {number} x Coordenada x do tile
   * @param {number} y Coordenada y do tile
   * @returns {Tile | null}
   */
  getTile(x, y) {
    if (
      x === undefined || y === undefined || 
      x < 0 || y < 0 || 
      x >= this.size || y >= this.size
    ) {
      return null;
    } else {
      return this.tiles[x][y];
    }
  }

  /**
   * Avança a simulação em um ou mais passos
   * @type {number} steps Número de passos a simular
   */
  simulate(steps = 1) {
    let count = 0;
    var roadCount = 0;
    var buildCount = 0;
    while (count++ < steps) {
      // Atualiza os serviços
      this.services.forEach((service) => service.simulate(this));

      // Atualiza cada tile
      for (let x = 0; x < this.size; x++) {
        for (let y = 0; y < this.size; y++) {
          const building = this.getTile(x, y).building;
          if (building) {
            if (building.type === BuildingType.residential) {
              buildCount++;
            } else if (building.type === BuildingType.road) {
              roadCount++;
            }
          }
          this.getTile(x, y).simulate(this);
        }
      }
    }

    var counter = 0;
    this.missionCounter = 0;
    for (const key of Object.keys(this.levels[this.level])) {
      const mission = this.levels[this.level][key];
      if (mission.citizens) {
        if (this.population >= mission.citizens) {
          mission.done = true;
        }
      } else if (mission.buildings) {
        if (buildCount >= mission.buildings) {
          mission.done = true;
        }
      } else if (mission.road) {
        if (roadCount >= mission.road) {
          mission.done = true;
        }
      }
      if (mission.done) {
        this.missionCounter++;
        counter++;
      }
    }

    if (counter == 3) {
      if (this.level == 1) {
        this.level++;
        this.money += 2500;
        window.ui.notify({type: "moneyGive", message: "Parabéns! Subiste de Nível: +2500$"});
      } else if (this.level == 2) {
        window.ui.notify({type: "success", message: "Parabéns! Concluiste as Missões!"});
        window.ui.toggleFinished();
      }
      counter = 0;
    }
    this.simTime++; // Incrementa o tempo da simulação
  }

   /**
   * Verifica se a cidade tem dinheiro para construção de X edificio
   * @param {BuildingType} buildingType Tipo de construção
   */
  hasMoneyForBuild(buildingType) {
    if (buildingType == BuildingType.residential && this.money >= 500) {
      this.money -= 500;
      return true;
    } else if (buildingType == BuildingType.road && this.money >= 100) {
      this.money -= 100;
      return true;
    }
    return false
  }

  /**
   * Coloca um edifício em um tile especificado
   * @param {number} x Coordenada x
   * @param {number} y Coordenada y
   * @param {string} buildingType Tipo do edifício
   */
  placeBuilding(x, y, buildingType) {
    const tile = this.getTile(x, y);

    // Verifica se o tile já possui um edifício
    if (tile && !tile.building) {
      const hasMoney = this.hasMoneyForBuild(buildingType);
      if (hasMoney) {
        window.ui.soundEffect("building");
        tile.setBuilding(createBuilding(x, y, buildingType));
        tile.refreshView(this);

        // Atualiza a visualização dos tiles vizinhos (ex: para estradas)
        this.getTile(x - 1, y)?.refreshView(this);
        this.getTile(x + 1, y)?.refreshView(this);
        this.getTile(x, y - 1)?.refreshView(this);
        this.getTile(x, y + 1)?.refreshView(this);

        // Atualiza o grafo de veículos se o edifício for uma estrada
        if (tile.building.type === BuildingType.road) {
          this.vehicleGraph.updateTile(x, y, tile.building);
          window.ui.notify({type: "moneyTake", message: "Estrada Construida: -100$"});
        } else { window.ui.notify({type: "moneyTake", message: "Edifício Construido: -500$"}); }
        
      } else {
        window.ui.notify({type: "error", message: "Dinheiro Insuficiente."});
      }
    }
  }

  /**
   * Demole um edifício em um tile especificado
   * @param {number} x Coordenada x
   * @param {number} y Coordenada y
   */
  bulldoze(x, y) {
    const tile = this.getTile(x, y);

    if (tile.building) {
      // Remove do grafo de veículos se for uma estrada
      if (tile.building.type === BuildingType.road) {
        this.money += 50;
        this.vehicleGraph.updateTile(x, y, null);
        window.ui.notify({type:"moneyGive", message:"Estrada Destruida: +50$"});
      } else if (tile.building.type === BuildingType.residential) { 
        window.ui.notify({type:"moneyGive", message:"Edifício Destruido: +250$"}); 
        this.money += 250; 
      }

      window.ui.soundEffect("bulldoze");
      tile.building.dispose(); // Libera recursos do edifício
      tile.setBuilding(null); // Remove o edifício
      tile.refreshView(this);

      // Atualiza os tiles vizinhos
      this.getTile(x - 1, y)?.refreshView(this);
      this.getTile(x + 1, y)?.refreshView(this);
      this.getTile(x, y - 1)?.refreshView(this);
      this.getTile(x, y + 1)?.refreshView(this);
    }
  }

  destroy(x, y) {
    const tile = this.getTile(x, y);

    if (tile.building) {
      if (tile.building.type === BuildingType.residential) {
        this.vehicleGraph.updateTile(x, y, null);
        window.ui.notify({type:"error", message:"Edifício Explodido!"});
        window.ui.notify({type:"error", message:"Residentes Não Sobreviveram!"});
        window.ui.soundEffect("explosion");
        tile.building.dispose(); // Libera recursos do edifício
        tile.setBuilding(null); // Remove o edifício
        tile.refreshView(this);
        this.getTile(x - 1, y)?.refreshView(this);
        this.getTile(x + 1, y)?.refreshView(this);
        this.getTile(x, y - 1)?.refreshView(this);
        this.getTile(x, y + 1)?.refreshView(this);
      }
    }
  }

  /**
   * Desenha ou atualiza a representação visual da cidade
   */
  
  draw() {
    // Método para ser implementado no futuro
    if (window.ui.isPaused || window.ui.isFinished) { return; }
  }

  /**
   * Encontra o primeiro tile que atende aos critérios fornecidos
   * @param {{x: number, y: number}} start Coordenadas iniciais
   * @param {(Tile) => (boolean)} filter Função para filtrar tiles
   * @param {number} maxDistance Distância máxima para busca
   * @returns {Tile | null} O primeiro tile que atende aos critérios ou `null`
   */
  findTile(start, filter, maxDistance) {
    const startTile = this.getTile(start.x, start.y);
    const visited = new Set();
    const tilesToSearch = [];

    // Inicializa a busca com o tile de início
    tilesToSearch.push(startTile);

    while (tilesToSearch.length > 0) {
      const tile = tilesToSearch.shift();

      // Ignora tiles já visitados
      if (visited.has(tile.id)) {
        continue;
      } else {
        visited.add(tile.id);
      }

      // Verifica se o tile está fora do limite de distância
      const distance = startTile.distanceTo(tile);
      if (distance > maxDistance) continue;

      // Adiciona vizinhos à lista de busca
      tilesToSearch.push(...this.getTileNeighbors(tile.x, tile.y));

      // Retorna o tile se passar nos critérios
      if (filter(tile)) {
        return tile;
      }
    }

    return null; // Nenhum tile encontrado
  }

  /**
   * Retorna os vizinhos de um tile
   * @param {number} x Coordenada x
   * @param {number} y Coordenada y
   */
  getTileNeighbors(x, y) {
    const neighbors = [];

    if (x > 0) {
      neighbors.push(this.getTile(x - 1, y));
    }
    if (x < this.size - 1) {
      neighbors.push(this.getTile(x + 1, y));
    }
    if (y > 0) {
      neighbors.push(this.getTile(x, y - 1));
    }
    if (y < this.size - 1) {
      neighbors.push(this.getTile(x, y + 1));
    }

    return neighbors;
  }

  toHTML() {
  }
}
