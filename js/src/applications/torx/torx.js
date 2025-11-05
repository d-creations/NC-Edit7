export class TorxView {
    constructor(parentDiv) {
        this.parentDiv = parentDiv;
        this.init();
    }
    init() {
        this.parentDiv.innerHTML = `
            <div class="torx">
                <div class="torx__header">
                    <h1 class="torx__header__title">TORX Creatot</h1>
                    <p class="torx__header__description">TORX is a tool for creating and managing your own TORX tokens.</p>
                    <div class="torx__header__actions">
                        <button class="torx__header__actions__button">Create TORX</button>
                        <button class="torx__header__actions__button">Manage TORX</button>
                    </div>
                    <div class="torx__header__input">
                                            <select id="param_T" class="torx_input">
                            <option value="T5">T5</option>
                            <option value="T6">T6</option>
                            <option value="T8">T8</option>
                            <option value="T10">T10</option>
                            <option value="T15">T15</option>
                            <option value="T20">T20</option>
                            <option value="T25">T25</option>
                            <option value="T30">T30</option>
                        </select>
                        <label for="param_T" class="torx_input_label">Torx Standard Size</label><br>
                        <input type="number" id="param_A" class="torx_input" placeholder="0.5">
                        <label for="param_A" class="torx_input_label">Diameter A A</label><br>
                        <input type="number" id="param_Ri" class="torx_input" placeholder="1.0">
                        <label for="param_Ri" class="torx_input_label">internal Radius Ri</label><br>
                        <input type="number" id="param_Re" class="torx_input" placeholder="1.0">
                        <label for="param_Re" class="torx_input_label">external Radius Re</label><br>
                        <input type="number" id="param_D" class="torx_input" placeholder="0.5">
                        <label for="param_D" class="torx_input_label">Depth Z</label><br>
                        <input type="number" id="param_FRi" class="torx_input" placeholder="0.5">
                        <label for="param_FRi" class="torx_input_label">Feed Ri</label><br>
                        <input type="number" id="param_FRe" class="torx_input" placeholder="0.5">
                        <label for="param_FRe" class="torx_input_label">Feed Re</label><br>
                        <input type="number" id="param_a" class="torx_input" placeholder="0.5">
                        <label for="param_a" class="torx_input_label">Deep Mill</label><br>

                        <button class="torx__header__input__button">Create Program</button>
                    </div>
                </div>
                <div class="torx__body">
                </div>
            </div>
        `;
    }
}
