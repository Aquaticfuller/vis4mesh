/* Message type               Index
 *cache.FlushReq              0
 *cache.FlushRsp              1
 *mem.DataReadyRsp            2
 *mem.ReadReq                 3
 *mem.WriteDoneRsp            4
 *mem.WriteReq                5
 *protocol.FlushReq           6
 *protocol.LaunchKernelReq    7
 *protocol.MapWGReq           8
 *protocol.WGCompletionMsg    9
 *vm.TranslationReq           10
 *vm.TranslationRsp           11
 */

export const MsgTypesInOrder: string[] = [
  "*mem.DataReadyRsp",
  "*mem.ReadReq",
  "*mem.WriteDoneRsp",
  "*mem.WriteReq",
];

function reverseArrayIdxAndValue(arr: string[]): Object {
  const rev = {};
  arr.forEach((val, idx) => {
    rev[val] = idx;
  });
  return rev;
}

export const MsgTypesInOrderIndexMap = reverseArrayIdxAndValue(MsgTypesInOrder);

export const MsgTypes = MsgTypesInOrder;
export const NumMsgTypes = MsgTypes.length;

export const MsgGroupsDomain = ["Translation", "Read", "Write", "Others"];
export const NumMsgGroups = MsgGroupsDomain.length;

export const MsgGroupsMap: Object = {
  "*mem.DataReadyRsp": "Read",
  "*mem.ReadReq": "Read",
  "*mem.WriteDoneRsp": "Write",
  "*mem.WriteReq": "Write",
};

function reverseObject(obj: Object): Object {
  const rev = {};
  Object.keys(obj).forEach((key) => {
    if (rev[obj[key]]) {
      rev[obj[key]].push(key);
    } else {
      rev[obj[key]] = [key];
    }
  });
  return rev;
}

export const MsgGroupsReverseMap = reverseObject(MsgGroupsMap);

export const DataOrCommandDomain = ["D", "C"];
export const NumDataOrCommand = DataOrCommandDomain.length;
export const DataOrCommandDomainNameExtend = (v: string) => {
  if (v === "D") {
    return "Data";
  } else if (v === "C") {
    return "Command";
  } else {
    console.error("Invalid input in DataOrCommandDomainNameExtend");
    return "Invalid";
  }
};

export const DataOrCommandMap: Object = {
  "*mem.DataReadyRsp": "D",
  "*mem.ReadReq": "C",
  "*mem.WriteDoneRsp": "C",
  "*mem.WriteReq": "D",
};

export const TransferTypesInOrder: string[] = [
  "mesh_send",
  "mesh_relay",
  "mesh_recv",
  "peripheral",
];

export const TransferTypesInOrderExtendNames = {
  mesh_send: "TX",
  mesh_relay: "Relay",
  mesh_recv: "RX",
  peripheral: "Outside NoC",
};

export const DataOrCommandReverseMap = reverseObject(DataOrCommandMap);
